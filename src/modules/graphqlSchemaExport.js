import prompts from "prompts";
import chalk from "chalk";
import graphql from "graphql"
import { writeFileSync, readFileSync, readdirSync, writeFile, unlinkSync, mkdirSync, renameSync, rmSync } from "fs";

export default async function qraphqlSchemaExport(){
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

        try{
            const {data, errors} = await fetch(responses.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": "Bearer "+responses.token
                },
                body: JSON.stringify({query: graphql.getIntrospectionQuery()})
            }).then(res => res.json())

            const schema = graphql.buildClientSchema(data)
            

            writeFileSync(responses.file, graphql.printSchema(schema))
            console.log(chalk.green("Schema loaded: "+responses.file))
            console.log();
        }catch(e){
            console.log(chalk.red("Error loading schema: "+e))
            console.log();
        }
    }
}