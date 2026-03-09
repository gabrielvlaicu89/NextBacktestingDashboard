import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireCurrentUser() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userById = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (userById) {
    return userById;
  }

  const email = session.user.email;
  if (!email) {
    throw new Error(
      "Authenticated session is missing an email. Please sign out and sign in again.",
    );
  }

  const userByEmail = await prisma.user.findUnique({
    where: { email },
  });
  if (userByEmail) {
    return userByEmail;
  }

  return prisma.user.create({
    data: {
      id: session.user.id,
      email,
      name: session.user.name ?? null,
      image: session.user.image ?? null,
    },
  });
}