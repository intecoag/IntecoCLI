import prompts from "prompts";
import chalk from "chalk";
import { buildClientSchema, getIntrospectionQuery, printSchema } from "graphql"
import { writeFileSync } from "fs";

type IntrospectionResponse = {
    data?: unknown;
    errors?: unknown;
};

export default async function qraphqlSchemaExport(): Promise<void> {
    console.log()
    
    let success = true;
    
    const responses = await prompts([{
        type: 'text',
        name: 'url',
        message: 'URL?',
        initial: "http://localhost:8080/graphql"
    },
    {
        type: 'text',
        name: 'token',
        message: 'AUTH-Token?'
    },
    {
        type: 'text',
        name: 'file',
        message: 'File-Name?',
        initial: 'schema.graphqls'
    }], {
        onCancel: () => {
            console.log()
            console.log(chalk.red("Cancelled GraphQL-Schema-Export!"))
            console.log()
            success = false
        }
    })

    if(success){
        console.log()

        try {
            const introspectionResult = await fetch(responses.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": "Bearer "+responses.token
                },
                body: JSON.stringify({query: getIntrospectionQuery()})
            }).then((res) => res.json()) as IntrospectionResponse;

            if (!introspectionResult.data) {
                throw new Error("No introspection data returned");
            }

            const schema = buildClientSchema(introspectionResult.data as Parameters<typeof buildClientSchema>[0])
            

            writeFileSync(responses.file, printSchema(schema))
            console.log(chalk.green("Schema loaded: "+responses.file))
            console.log();
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.log(chalk.red("Error loading schema: "+errorMessage))
            console.log();
        }
    }
}

