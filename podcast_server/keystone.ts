import { config } from "@keystone-6/core";
import { session, withAuth } from "./auth";
import { User } from "./schema/user.schema";
import { Artist } from "./schema/artist.schema";
import { Podcast } from "./schema/podcast.schema";

export default withAuth (
    config({
        db: {
            provider: 'sqlite',
            url: 'file:./db.sqlite'
        },
        lists: { User, Artist, Podcast },
        session: session,
        ui: {
            isAccessAllowed: ({ session }) => {
                return !!session?.data?.isAdmin;
            }
        }
    })
)