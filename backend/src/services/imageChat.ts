import { HttpError } from "../http.js";
import { asObjectId } from "../lib/objectId.js";
import { titleFrom } from "../lib/titleFrom.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { Companion } from "../models/Companion.js";
import { buildEducationalDiagram, svgToBase64 } from "./diagrams.js";
import { editAiImage, generateAiImage } from "./images.js";

async function resolveConversation(input: {
  userId: string;
  conversationId?: string;
  companionId?: string;
  titleSeed: string;
}) {
  let conversation = null;
  if (input.conversationId) {
    conversation = await Conversation.findOne({ _id: asObjectId(input.conversationId), userId: input.userId });
    if (!conversation) throw new HttpError(404, "That conversation was not found.", "NOT_FOUND");
  }
  const companionId = input.companionId ?? conversation?.companionId?.toString();
  const companion = companionId
    ? await Companion.findOne({ _id: asObjectId(companionId), userId: input.userId })
    : await Companion.findOne({ userId: input.userId, isDefault: true });
  if (!companion) throw new HttpError(400, "Choose a companion first.", "NO_COMPANION");

  if (!conversation) {
    conversation = await Conversation.create({
      userId: input.userId,
      companionId: companion._id,
      title: titleFrom(input.titleSeed),
    });
  } else if (!(await Message.exists({ conversationId: conversation._id, userId: input.userId }))) {
    conversation.title = titleFrom(input.titleSeed);
    await conversation.save();
  }
  conversation.updatedAt = new Date();
  await conversation.save();
  return { conversation, companion };
}

function serializeMessage(message: {
  id?: string;
  _id: { toString(): string };
  sender: string;
  kind?: string;
  content: string;
  attachment?: { name?: string | null; mimeType?: string | null; data?: string | null } | null;
  createdAt?: Date;
}) {
  const name = message.attachment?.name;
  const mimeType = message.attachment?.mimeType;
  const data = message.attachment?.data;
  const attachment = name && mimeType && data ? { name, mimeType, data } : undefined;
  return {
    id: message.id ?? message._id.toString(),
    sender: message.sender,
    kind: message.kind ?? "ai",
    content: message.content,
    attachment,
    places: [],
    createdAt: message.createdAt,
  };
}

export async function createGeneratedImageReply(input: {
  userId: string;
  conversationId?: string;
  companionId?: string;
  prompt: string;
  style?: string;
  purpose?: "general" | "study" | "presentation" | "poster";
}) {
  const prompt = input.prompt.trim();
  if (prompt.length < 2) throw new HttpError(400, "Describe the image you want.", "EMPTY_PROMPT");
  const { conversation, companion } = await resolveConversation({
    userId: input.userId,
    conversationId: input.conversationId,
    companionId: input.companionId,
    titleSeed: prompt,
  });

  const image = await generateAiImage({
    prompt,
    style: input.style,
    purpose: input.purpose ?? "general",
  });

  const userMessage = await Message.create({
    conversationId: conversation._id,
    userId: input.userId,
    sender: "user",
    kind: "ai",
    content: prompt.slice(0, 4000),
    places: [],
  });
  const caption = image.caption || "Here is the generated image.";
  const assistantMessage = await Message.create({
    conversationId: conversation._id,
    userId: input.userId,
    sender: "assistant",
    kind: "ai",
    content: `${caption}\n\n(Generated with ${image.model}. You can download or ask for edits.)`.slice(0, 12000),
    attachment: { name: image.name, mimeType: image.mimeType, data: image.data },
    places: [],
  });

  return {
    conversation: {
      id: conversation.id,
      title: conversation.title,
      companionId: companion.id,
      updatedAt: conversation.updatedAt,
    },
    userMessage: serializeMessage(userMessage),
    assistantMessage: serializeMessage(assistantMessage),
    image: { name: image.name, mimeType: image.mimeType, model: image.model },
  };
}

export async function createEditedImageReply(input: {
  userId: string;
  conversationId?: string;
  companionId?: string;
  prompt: string;
  image: { name: string; mimeType: string; data: string };
}) {
  const prompt = input.prompt.trim();
  if (prompt.length < 2) throw new HttpError(400, "Describe how to edit the image.", "EMPTY_PROMPT");
  const { conversation, companion } = await resolveConversation({
    userId: input.userId,
    conversationId: input.conversationId,
    companionId: input.companionId,
    titleSeed: `Edit: ${prompt}`,
  });

  const edited = await editAiImage({ prompt, image: input.image });
  const userMessage = await Message.create({
    conversationId: conversation._id,
    userId: input.userId,
    sender: "user",
    kind: "ai",
    content: prompt.slice(0, 4000),
    attachment: {
      name: input.image.name.slice(0, 80),
      mimeType: input.image.mimeType,
      data: input.image.data,
    },
    places: [],
  });
  const caption = edited.caption || "Here is the edited image.";
  const assistantMessage = await Message.create({
    conversationId: conversation._id,
    userId: input.userId,
    sender: "assistant",
    kind: "ai",
    content: `${caption}\n\n(Edited with ${edited.model}. Original kept in your message above.)`.slice(0, 12000),
    attachment: { name: edited.name, mimeType: edited.mimeType, data: edited.data },
    places: [],
  });

  return {
    conversation: {
      id: conversation.id,
      title: conversation.title,
      companionId: companion.id,
      updatedAt: conversation.updatedAt,
    },
    userMessage: serializeMessage(userMessage),
    assistantMessage: serializeMessage(assistantMessage),
    image: { name: edited.name, mimeType: edited.mimeType, model: edited.model },
  };
}

export async function createDiagramReply(input: {
  userId: string;
  conversationId?: string;
  companionId?: string;
  prompt: string;
  kind?: "flowchart" | "network" | "er" | "uml" | "cycle" | "labeled";
}) {
  const prompt = input.prompt.trim();
  if (prompt.length < 2) throw new HttpError(400, "Describe the diagram you need.", "EMPTY_PROMPT");
  const { conversation, companion } = await resolveConversation({
    userId: input.userId,
    conversationId: input.conversationId,
    companionId: input.companionId,
    titleSeed: prompt,
  });

  const diagram = await buildEducationalDiagram({ prompt, kind: input.kind });
  const data = svgToBase64(diagram.svg);
  const userMessage = await Message.create({
    conversationId: conversation._id,
    userId: input.userId,
    sender: "user",
    kind: "ai",
    content: prompt.slice(0, 4000),
    places: [],
  });
  const assistantMessage = await Message.create({
    conversationId: conversation._id,
    userId: input.userId,
    sender: "assistant",
    kind: "ai",
    content: `Educational diagram: ${diagram.title}${diagram.notes ? `\n${diagram.notes}` : ""}\n\nLabels are generated for learning — check them against your course.`.slice(0, 12000),
    attachment: { name: diagram.name, mimeType: diagram.mimeType, data },
    places: [],
  });

  return {
    conversation: {
      id: conversation.id,
      title: conversation.title,
      companionId: companion.id,
      updatedAt: conversation.updatedAt,
    },
    userMessage: serializeMessage(userMessage),
    assistantMessage: serializeMessage(assistantMessage),
    image: { name: diagram.name, mimeType: diagram.mimeType, model: "sahara-diagram-svg" },
  };
}
