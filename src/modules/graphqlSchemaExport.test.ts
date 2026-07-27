import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    prompts: vi.fn(),
    buildClientSchema: vi.fn(),
    getIntrospectionQuery: vi.fn(),
    printSchema: vi.fn(),
    writeFileSync: vi.fn()
}));

vi.mock("prompts", () => ({ default: mocks.prompts }));
vi.mock("graphql", () => ({
    buildClientSchema: mocks.buildClientSchema,
    getIntrospectionQuery: mocks.getIntrospectionQuery,
    printSchema: mocks.printSchema
}));
vi.mock("fs", () => ({ writeFileSync: mocks.writeFileSync }));

import graphqlSchemaExport from "./graphqlSchemaExport.js";

describe("graphqlSchemaExport", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        mocks.getIntrospectionQuery.mockReturnValue("{__schema{types{name}}}");
        mocks.buildClientSchema.mockReturnValue({ kind: "schema" });
        mocks.printSchema.mockReturnValue("type Query { ping: String }");
    });

    it("writes schema file on successful introspection", async () => {
        mocks.prompts.mockResolvedValue({
            url: "http://localhost/graphql",
            token: "abc",
            file: "schema.graphqls"
        });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            json: async () => ({ data: { __schema: {} } })
        }));

        await graphqlSchemaExport();

        expect(mocks.buildClientSchema).toHaveBeenCalled();
        expect(mocks.writeFileSync).toHaveBeenCalledWith("schema.graphqls", "type Query { ping: String }");
    });

    it("skips export when prompt is cancelled", async () => {
        mocks.prompts.mockImplementation(async (_questions, options) => {
            options?.onCancel?.();
            return {};
        });

        await graphqlSchemaExport();

        expect(mocks.writeFileSync).not.toHaveBeenCalled();
    });

    it("handles missing introspection data", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        mocks.prompts.mockResolvedValue({
            url: "http://localhost/graphql",
            token: "abc",
            file: "schema.graphqls"
        });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            json: async () => ({ errors: ["nope"] })
        }));

        await graphqlSchemaExport();

        expect(mocks.writeFileSync).not.toHaveBeenCalled();
        expect(logSpy.mock.calls.map((c) => String(c[0] ?? "")).join("\n")).toContain("Error loading schema");
    });
});
