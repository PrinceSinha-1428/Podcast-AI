import { mergeSchemas } from "@graphql-tools/schema";
import axios from "axios";
import { gql } from 'graphql-tag';

const GEMENI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const API_KEY = process.env.GEMENI_API_KEY;




export const extendedGraphqlSchema = (schema: any) => mergeSchemas({
    schemas: [schema],
    typeDefs: gql`
        type RegisterResponse {
            user: User
        }
        type PodcastRecommendation {
            id: ID!
            title: String! 
            category: String!
            video_uri: String 
            artwork: String 
            lyricist: String 
            type: String!
            audio_uri: String
            artist: ArtistInfo
            isFavourite: Boolean!
        }
        type ArtistInfo {
            id: ID!
            name: String!
            bio: String
            photo: String
        }
        extend type Mutation {
        registerUser(
                name: String!
                email: String!
                password: String!
            ): RegisterResponse
        }
        extend type Query {
            getRecommendedPodcasts(userId: ID!): [PodcastRecommendation]
        }
    `,
    resolvers: {
        Mutation: {
            registerUser: async (root, {name, email, password}, context) => {
                const existingUser = await context.db.User.findOne({
                    where: { email },
                });
                if(existingUser) throw new Error("User already exists");
                const newUser = await context.db.User.createOne({
                    data: {name, email, password},
                });
                return newUser
            },
        },
        Query: {
            getRecommendedPodcasts: async (_, { userId }, context) => {
                try {
                    const user = await context.db.User.findOne({
                        where: {id: userId},
                        query: "id favoritePodcasts {id title category}",
                    });
                    if(!user) throw new Error("User not found");
                    const favoritePodcasts = user.favoritePodcasts || [];
                    const favoriteCategories = [
                        ... new Set(favoritePodcasts.map((p: any) => p.category )),
                    ];
                    const allPodcasts = await context.db.Podcast.findMany({
                        query: `
                            id
                            title
                            category
                            video_uri 
                            artwork
                            lyricist
                            type
                            audio_uri
                            artist { 
                                id
                                name
                                bio
                                photo
                            }
                        `
                    });

                    const favoritePodcastIds = favoritePodcasts.map((p: any) => p.id);
                    const availablePodcasts = allPodcasts.filter((p: any) => !favoritePodcastIds.includes(p.id));

                    if(availablePodcasts.length === 0){
                        return [];
                    }
                    const prompt = `
                        You are an AI podcast recommendation system.
                        The user has listened to these categories: ${
                            favoriteCategories?.length ? 
                            favoriteCategories?.join(", ") : "None"
                        }.
                        From the following available podcasts, suggest 3 that match their interests:
                        ${
                            availablePodcasts?.length ?
                            availablePodcasts.map((p: any) => `${p.title} (Category: ${p?.category}, Artist: ${p?.artist?.name})`).join("\n") : 'No podcasts available'
                        }
                        Return the title in JSON format: 
                        {
                            "recommendations": ["Title1", "Title2", "Title3"] 
                        }
                    `;

                    const response  = await axios.post(
                        `${GEMENI_API_URL}?key=${API_KEY}`,
                        {
                            contents: [
                                {
                                    parts: [{ text: prompt }],
                                },
                            ],
                        },
                        {
                            headers: { "Content-Type": "application/json" },
                        }
                    );

                    const aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
                    const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/);

                    if(!jsonMatch) throw new Error("AI Response does not contain JSON");
                    const jsonString = jsonMatch[1];
                    const { recommendations } = JSON.parse(jsonString);

                    if(!Array.isArray(recommendations)){
                        throw new Error("Invalid AI Response Format");
                    }
                    const matchedPodcasts = allPodcasts.filter((p: any) => recommendations.includes(p.title));
                    const podcastsWithArtist = matchedPodcasts?.map((podcast: any) => {
                        return {
                            ...podcast,
                            artist: {
                                bio: "Ai generated suggestion",
                                id: 123,
                                name: "Gemeni AI",
                                photo: "https://miro.medium.com/v2/1*-i43ZJb8eFhQnJxnIaPslg.jpeg"
                            }
                        }
                    });
                    return podcastsWithArtist;

                } catch (error: unknown) {
                    if(error instanceof Error){
                        console.log(error.message);
                        throw new Error("Failed to get recommendations")
                    }
                }
            }
        }
    }
})