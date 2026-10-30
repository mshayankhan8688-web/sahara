import assert from "node:assert/strict";
import { test } from "node:test";
import { titleFrom } from "./titleFrom.js";

test("builds a short title from meaningful words", () => {
  assert.equal(titleFrom("I am feeling lonely and thinking too much."), "Feeling lonely thinking");
  assert.equal(titleFrom("Plan my day"), "Plan my day");
  assert.equal(titleFrom("   "), "New chat");
});

test("collapses repeated words instead of hello hello hello", () => {
  assert.equal(titleFrom("hello hello hello hello hello"), "Hello");
  assert.equal(titleFrom("hello hello world"), "Hello world");
});

test("keeps study prompts short", () => {
  assert.equal(titleFrom("I want to learn JavaScript this week"), "Learn JavaScript week");
  assert.ok(titleFrom("Explain recursion with a simple example for class tomorrow").length <= 42);
});

test("never returns an excessively long sidebar title", () => {
  const long = "hello ".repeat(40).trim();
  const title = titleFrom(long);
  assert.equal(title, "Hello");
  assert.ok(title.length <= 42);

  const essay = "I am feeling lonely and thinking too much and I don't know what to do with my life anymore today";
  const short = titleFrom(essay);
  assert.ok(short.length <= 42);
  assert.doesNotMatch(short, /I don't know what to do/);
  assert.match(short, /lonely|feeling|thinking/i);
});

test("roman urdu loneliness becomes a short title", () => {
  const title = titleFrom("Yaar aaj bohat lonely feel ho raha hai aur overthinking kar raha hoon");
  assert.ok(title.length <= 42);
  assert.match(title, /lonely|overthinking|feel/i);
});
