import 'graphql-import-node';
import fastify = require('fastify');
import { getGraphQLParameters, processRequest, Request, sendResult, renderGraphiQL, shouldRenderGraphiQL } from "graphql-helix";
import { schema } from './schema';
import { contextFactory } from './context';

async function main() {
   const server = fastify();

   server.route({
        method: ["POST","GET"],
        url: "/graphql",
        handler: async (req, reply) => {
            const request: Request = {
                headers: req.headers,
                method: req.method,
                query: req.query,
                body: req.body,
            };

            if (shouldRenderGraphiQL(request)) {
                reply.header("Content-Type", "text/html");
                reply.send(renderGraphiQL({
                    endpoint: "graphql"
                }))
                return;
            }

            const { operationName, query, variables } = getGraphQLParameters(request);

            const result = await processRequest({
                request,
                schema,
                operationName,
                contextFactory: () => contextFactory(req),
                query,
                variables,
            })

            sendResult(result, reply.raw);
        }
   });
   
   server.get("/", (req, reply) => {
    reply.send({test: true})
   })

   server.listen(3000, "0.0.0.0", () => {
    console.log("Running")
   })
}

main();