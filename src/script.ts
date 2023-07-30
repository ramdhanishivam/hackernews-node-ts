import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
 async function main() {
    const newLink = await prisma.link.create({
        data: {
            description: "desc1",
            url: "url1",
        },
    });

    let allLinks = await prisma.link.findMany();
    console.log(allLinks);
    // const delLink = await prisma.link.delete({
    //     where: {
    //         id: 1
    //     }
    // })
    // allLinks = await prisma.link.findMany();
    // console.log(allLinks);
 }

 main()
    .catch(e => {
        throw e;
    })
    .finally(async () => {
        await prisma.$disconnect()
    })