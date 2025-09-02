import { config } from "@keystone-6/core";
import { session, withAuth } from "./auth";
import { User } from "./schema/user.schema";

export default withAuth (
    config({
        db: {
            provider: 'sqlite',
            url: 'file:./db.sqlite'
        },
        lists: { User },
        session: session,
        ui: {
            isAccessAllowed: ({ session }) => {
                return !!session?.data?.isAdmin;
            }
        }
    })
)