import mysql from "mysql-await"
import { Config } from "../config/config.js";

export class DB{
    static connection;

    static async connect(db){
        const config = await Config.getConfig();

        this.connection = mysql.createConnection({
            host:config.dbURL,
            user:config.dbUser,
            password:config.dbPassword,
            database: db!=null?db:""
        })
    }

    static async executeQuery(query){
        await this.connect(null)

        let results = await this.connection.awaitQuery(query)

        this.connection.end();

        return results
    }

    static async executeQueryOnDB(query, db){
        await this.connect(db)

        let results = await this.connection.awaitQuery(query)

        this.connection.end();

        return results
    }

    static async getDatabaseNames(){
        await this.connect(null)

        let results = await this.connection.awaitQuery("SHOW DATABASES")

        this.connection.end();

        results = results.filter((val) => {
            if(val.Database == "sys" || val.Database == "information_schema" || val.Database == "mysql" || val.Database == "performance_schema"){
                return false;
            }
            return true
        })

        return results.map(result => {return {"name":result.Database}})
    }
}