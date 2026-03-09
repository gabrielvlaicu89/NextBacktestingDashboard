"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import type { CustomStrategyDefinitionRecord } from "@/lib/types";
import {
  createCustomStrategyDefinitionSchema,
  customStrategyDraftSchema,
  updateCustomStrategyDefinitionSchema,
} from "@/lib/validations";

function revalidateCustomStrategyPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/new");
  revalidatePath("/dashboard/build-custom-stratergy");
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function parseStoredDefinition(
  definition: unknown,
  definitionId: string,
): CustomStrategyDefinitionRecord["definition"] {
  const parsed = customStrategyDraftSchema.safeParse(definition);
  if (!parsed.success) {
    throw new Error(
      `Stored custom strategy definition '${definitionId}' is invalid: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
    );
  }

  return parsed.data;
}

function serialiseCustomStrategyDefinition(record: {
  id: string;
  userId: string;
  name: string;
  description: string;
  definitionVersion: number;
  definition: unknown;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}): CustomStrategyDefinitionRecord {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    description: record.description,
    definitionVersion: record.definitionVersion,
    definition: parseStoredDefinition(record.definition, record.id),
    tags: record.tags,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function getCustomStrategyDefinitions(): Promise<
  CustomStrategyDefinitionRecord[]
> {
  const user = await requireCurrentUser();

  const definitions = await prisma.customStrategyDefinition.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  return definitions.map(serialiseCustomStrategyDefinition);
}

export async function getCustomStrategyDefinition(
  id: string,
): Promise<CustomStrategyDefinitionRecord | null> {
  const user = await requireCurrentUser();

  const definition = await prisma.customStrategyDefinition.findUnique({
    where: { id },
  });

  if (!definition || definition.userId !== user.id) {
    return null;
  }

  return serialiseCustomStrategyDefinition(definition);
}

export async function createCustomStrategyDefinition(
  input: unknown,
): Promise<CustomStrategyDefinitionRecord> {
  const user = await requireCurrentUser();

  const parsed = createCustomStrategyDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `Validation failed: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
    );
  }

  const { definition, tags } = parsed.data;

  const created = await prisma.customStrategyDefinition.create({
    data: {
      userId: user.id,
      name: definition.name,
      description: definition.description,
      definitionVersion: definition.version,
      definition: toInputJsonValue(definition),
      tags,
    },
  });

  revalidateCustomStrategyPaths();
  return serialiseCustomStrategyDefinition(created);
}

export async function updateCustomStrategyDefinition(
  id: string,
  input: unknown,
): Promise<CustomStrategyDefinitionRecord> {
  const user = await requireCurrentUser();

  const existing = await prisma.customStrategyDefinition.findUnique({
    where: { id },
  });
  if (!existing || existing.userId !== user.id) {
    throw new Error("Custom strategy definition not found or forbidden");
  }

  const parsed = updateCustomStrategyDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `Validation failed: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
    );
  }

  const { definition, tags } = parsed.data;
  const updated = await prisma.customStrategyDefinition.update({
    where: { id },
    data: {
      ...(definition
        ? {
            name: definition.name,
            description: definition.description,
            definitionVersion: definition.version,
            definition: toInputJsonValue(definition),
          }
        : {}),
      ...(tags ? { tags } : {}),
    },
  });

  revalidateCustomStrategyPaths();
  return serialiseCustomStrategyDefinition(updated);
}

export async function deleteCustomStrategyDefinition(id: string): Promise<void> {
  const user = await requireCurrentUser();

  const existing = await prisma.customStrategyDefinition.findUnique({
    where: { id },
  });
  if (!existing || existing.userId !== user.id) {
    throw new Error("Custom strategy definition not found or forbidden");
  }

  await prisma.customStrategyDefinition.delete({ where: { id } });
  revalidateCustomStrategyPaths();
}

export async function duplicateCustomStrategyDefinition(
  id: string,
): Promise<CustomStrategyDefinitionRecord> {
  const user = await requireCurrentUser();

  const existing = await prisma.customStrategyDefinition.findUnique({
    where: { id },
  });
  if (!existing || existing.userId !== user.id) {
    throw new Error("Custom strategy definition not found or forbidden");
  }

  const storedDefinition = parseStoredDefinition(existing.definition, existing.id);
  const duplicatedDefinition = {
    ...storedDefinition,
    name: `${storedDefinition.name} (Copy)`,
  };

  const duplicated = await prisma.customStrategyDefinition.create({
    data: {
      userId: user.id,
      name: duplicatedDefinition.name,
      description: duplicatedDefinition.description,
      definitionVersion: duplicatedDefinition.version,
      definition: toInputJsonValue(duplicatedDefinition),
      tags: existing.tags,
    },
  });

  revalidateCustomStrategyPaths();
  return serialiseCustomStrategyDefinition(duplicated);
}
