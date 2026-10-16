import { StringStream } from "@codemirror/language";
import { describe, expect, it } from "vitest";
import { basicParser, indentAfter, type BasicState } from "./lang.ts";

/** [text, token] pairs for each line, skipping whitespace. */
function tokenize(source: string): [string, string | null][][] {
  const state: BasicState = basicParser.startState!(1);
  return source.split("\n").map((line) => {
    const stream = new StringStream(line, 4, 1);
    const out: [string, string | null][] = [];
    while (!stream.eol()) {
      const style = basicParser.token(stream, state);
      const text = stream.current();
      if (text.trim()) out.push([text, style]);
      stream.start = stream.pos;
    }
    return out;
  });
}

describe("the 7800basic language mode", () => {
  it("reads labels, keywords, comments and numbers", () => {
    expect(tokenize("main\n rem draw it all\n drawscreen : goto main")).toEqual([
      [["main", "labelName"]],
      [["rem draw it all", "comment"]],
      [
        ["drawscreen", "keyword"],
        [":", "punctuation"],
        ["goto", "keyword"],
        ["main", "labelName"],
      ],
    ]);
  });

  it("knows hex, binary, decimal and fixed-point numbers", () => {
    expect(tokenize(" P0C1 = $1C : x = %0101 : y = 12 : z = 1.5")[0]!).toEqual([
      ["P0C1", "builtin"],
      ["=", "operator"],
      ["$1C", "number"],
      [":", "punctuation"],
      ["x", "variableName"],
      ["=", "operator"],
      ["%0101", "number"],
      [":", "punctuation"],
      ["y", "variableName"],
      ["=", "operator"],
      ["12", "number"],
      [":", "punctuation"],
      ["z", "variableName"],
      ["=", "operator"],
      ["1.5", "number"],
    ]);
  });

  it("reads modes and sizes as one word", () => {
    expect(tokenize(" displaymode 160A : set romsize 32k")[0]).toEqual([
      ["displaymode", "keyword"],
      ["160A", "atom"],
      [":", "punctuation"],
      ["set", "keyword"],
      ["romsize", "keyword"],
      ["32k", "atom"],
    ]);
  });

  it("treats rem as a comment only where a statement starts", () => {
    expect(tokenize(" if x then rem nothing")[0]!.at(-1)).toEqual(["rem nothing", "comment"]);
    expect(tokenize(" a = 1 : rem set a")[0]!.at(-1)).toEqual(["rem set a", "comment"]);
    expect(tokenize(" remaining = 3")[0]![0]).toEqual(["remaining", "variableName"]);
    expect(tokenize(" REM shouting")[0]!).toEqual([["REM shouting", "comment"]]);
  });

  it("reads strings, built-ins and every label after on … goto", () => {
    expect(tokenize(" alphachars '0123 ABC'")[0]!).toEqual([
      ["alphachars", "keyword"],
      ["'0123 ABC'", "string"],
    ]);
    expect(tokenize(" if joy0fire && rand > 9 then x = 1")[0]!.map((t) => t[1])).toEqual([
      "keyword", "builtin", "operator", "builtin", "operator", "number", "keyword", "variableName", "operator", "number",
    ]);
    expect(tokenize(" on state goto title play over")[0]!.slice(3)).toEqual([
      ["title", "labelName"],
      ["play", "labelName"],
      ["over", "labelName"],
    ]);
  });

  it("shows asm blocks as assembly until end", () => {
    const lines = tokenize(" asm\n lda #$01 ; a comment\n end\n x = 1");
    expect(lines[1]).toEqual([[" lda #$01 ; a comment", "meta"]]);
    expect(lines[2]).toEqual([["end", "keyword"]]);
    expect(lines[3]![0]).toEqual(["x", "variableName"]);
  });

  it("indents after labels and keeps the indent of statements", () => {
    expect(indentAfter("main")).toBe(1);
    expect(indentAfter("   x = 1")).toBe(3);
    expect(indentAfter("")).toBe(1);
  });
});
