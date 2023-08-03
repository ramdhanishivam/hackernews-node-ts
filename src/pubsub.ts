import { PubSub } from "graphql-subscriptions";
import { TypedPubSub } from "typed-graphql-subscriptions";
import { Link, Vote } from "@prisma/client";

// First, you declare a TypeScript type PubSubChannels, you’ll later use that to define your type-safe events.
export type PubSubChannels = {
    newLink: [{ createdLink: Link }];
    newVote: [{createdVote: Vote}];
};

// Then, create an instance of PubSub and combine it with the type-safe events wrapper to form a fully-typed Pub/Sub instance.
export const pubSub = new TypedPubSub<PubSubChannels>(new PubSub());