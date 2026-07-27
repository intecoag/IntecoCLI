import { describe, expect, it } from "vitest";
import { parseHeadersFromCreateStatement, parseInsertRecords } from "./dumpTableToCSV.js";

describe("dumpTableToCSV parsing helpers", () => {
    it("parses create table header fields and skips table name", () => {
        const headerData = "CREATE TABLE `t009` (`t009_mnr` int(11), `t009_name` varchar(50), PRIMARY KEY (`t009_mnr`))";

        const headers = parseHeadersFromCreateStatement(headerData, "t009");

        expect(headers).toEqual(["`t009_mnr`", "`t009_name`", "`t009_mnr`"]);
    });

    it("parses insert records from VALUES tuples", () => {
        const data = "INSERT INTO `t009` VALUES (1,'a'),(2,'b'),(3,'c');";

        const records = parseInsertRecords(data);

        expect(records).toEqual(["1,'a'", "2,'b'", "3,'c'"]);
    });
});
