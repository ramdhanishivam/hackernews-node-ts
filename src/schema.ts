import { makeExecutableSchema } from "@graphql-tools/schema";
import typeDefs from './schema.graphql';
import { GraphQLSchema } from "graphql";
import { GraphQLContext } from "./context";
import { compare, hash } from "bcryptjs";
import { sign } from "jsonwebtoken";
import { APP_SECRET } from "./auth";
import { Link, User,  } from "@prisma/client";
import { PubSubChannels } from "./pubsub";

// Prisma Client exposes a CRUD API for the models in your datamodel 
// for you to read and write in your database

// The primary purpose of the context argument in GraphQL resolvers is to allow resolvers to 
// communicate and share data with each other during the execution of a GraphQL query.

// The context object acts as a shared space where information can be stored and accessed by all resolvers
// involved in processing a particular GraphQL request. It provides a means for resolvers to access 
// data that may not be part of the query arguments 
// but is necessary for resolving certain fields or making decisions based on shared information.

// For example, one resolver might fetch some data from a database or external 
// API and store it in the context, making it available to other resolvers that require the 
// same data. This way, the data does not need to be fetched repeatedly for 
// each field, improving performance and reducing redundant operations.
const resolvers = {
  Query: {
    info: () => 'This is the api for hackernews clone',
    feed: async (parent: unknown, args: {}, context: GraphQLContext) => {
      return context.prisma.link.findMany()
    },
    me: (parent: unknown, args: {}, context: GraphQLContext) => {
      if(context.currentUser == null){
        throw new Error("Unauthenticated");
      }
      return context.currentUser;
    }
  },
  Link: {
    id: (parent: Link) => parent.id,
    url: (parent: Link) => parent.url,
    description: (parent: Link) => parent.description,
    postedBy: async (parent: Link, args: [], context: GraphQLContext) => {
      if(!parent.postedById){
        return null;
      }
      return context.prisma.link.findUnique({
        where: {
          id: parent.id
        }
      }).postedBy();
    },
    votes: (parent: Link, args: {}, context: GraphQLContext) => {
      context.prisma.link.findUnique({
        where: {
          id: parent.id
        }
      }).votes()
    }
  },
  Mutation: {
    post: async (
      parent: unknown,
      args: {description: string, url: string},
      context: GraphQLContext
      ) => {

      if (context.currentUser === null) {
        throw new Error("Unauthenticated!");
      }

      const newLink = await context.prisma.link.create({
        data: {
          url: args.url,
          description: args.description,
          postedBy: {connect: {id: context.currentUser.id}}
        },
      })

      context.pubSub.publish("newLink", {createdLink: newLink})
      return newLink;
    },
    signup: async (
      parent: unknown,
      args: { email: string, password: string, name: string },
      context: GraphQLContext
    ) => {
      const password = await hash(args.password, 10);
      const user = await context.prisma.user.create({
        data: {
          ...args, password
        }
      })

      const token = sign({ userId: user.id }, APP_SECRET);
      return {
        token,
        user
      };

    },
    login: async (
      parent: unknown,
      args: {email: string, password: string},
      context: GraphQLContext
    ) => {
      const user = await context.prisma.user.findUnique({
        where: {
          email: args.email
        }
      });

      if (!user) {
        throw new Error("No such user found");
      }

      const valid = await compare(args.password, user.password);

      if (!valid) {
        throw new Error("Incorrect Passord")
      }

      const token = await sign({userId: user.id}, APP_SECRET);

      return{
        token,
        user,
      }
    },
    vote: async (parent: unknown, args: {
      link: string;linkId: string
}, context: GraphQLContext) => {
      if (!context.currentUser) {
        throw new Error("You must login inorder to upvote");
      }

      const userId = context.currentUser.id;

      const vote = await context.prisma.vote.findUnique({
        where: {
          linkId_userId: {
            linkId:  Number(args.link),
            userId: userId
          }
        }
      })

      if (vote !== null) {
        throw new Error("Already upvoted")
      }

      const newVote = await context.prisma.vote.create({
        data:{
          user: { connect: {id: userId} },
          link: { connect: { id: Number(args.link)} }
        }
      })

      context.pubSub.publish("newVote", {createdVote: newVote});

      return newVote;
    }
  },
  User: {
    links: (parent: User, args:{},context: GraphQLContext) => {
      context.prisma.user.findUnique({where: {id: parent.id}}).links()
    }
  },
  Subscription: {
    newLink: {
      subscribe: (parent: unknown, args: [], context: GraphQLContext) => {
        return context.pubSub.asyncIterator("newLink")
      },
      resolve: (payload: PubSubChannels["newLink"][0]) => {
        return payload.createdLink;
      }
    },
    newVote: {
      subscribe: (parent: unknown, args: [], context: GraphQLContext) => {
        return context.pubSub.asyncIterator("newVote")
      },
      resolve: (payload: PubSubChannels["newVote"][0]) => {
        return payload.createdVote
      }
    }
  },
  Vote: {
    link: (parent: User, args: [], context: GraphQLContext) => 
      context.prisma.vote.findUnique({where: {id: parent.id}}).link(),
    user: (parent: User, args: [], context: GraphQLContext) => 
      context.prisma.vote.findUnique({where: {id: parent.id}}).user()
  }
};

export const schema: GraphQLSchema = makeExecutableSchema({
  typeDefs,
  resolvers,
});