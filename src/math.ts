import { LSP } from "./client";

export function compare(p1: LSP.Position, p2: LSP.Position) {
    let cmp = p1.line - p2.line;
    if (cmp == 0) {
        cmp = p1.character - p2.character
    }
    return cmp
}