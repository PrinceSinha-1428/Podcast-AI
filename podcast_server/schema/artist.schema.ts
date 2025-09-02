import { list } from "@keystone-6/core";
import { checkbox, password, text, timestamp } from "@keystone-6/core/fields";

export const User = list({
    access: {
        operation: {
            query: () => true,
            create: ({session}) => !!session,
            update: ({session}) => !!session,
            delete: ({session}) => !!session,
        },
    },
    fields: {
        name: text({validation: { isRequired: true }}),
        bio: text(),
        photo: text()
    }
})