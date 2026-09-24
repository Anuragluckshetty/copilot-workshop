import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

export interface GameFilters {
    categoryIds?: number[];
    publisherId?: number;
}

export async function getAllCategories(db: Database): Promise<{ id: number; name: string }[]> {
    return db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
}

export async function getAllPublishers(db: Database): Promise<{ id: number; name: string }[]> {
    return db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
}

/** Games matching the selected categories and publisher, ordered by title. */
export async function getFilteredGames(db: Database, filters: GameFilters): Promise<Game[]> {
    const predicates = [];
    if (filters.categoryIds && filters.categoryIds.length > 0) {
        predicates.push(
            filters.categoryIds.length === 1
                ? eq(games.categoryId, filters.categoryIds[0])
                : inArray(games.categoryId, filters.categoryIds),
        );
    }
    if (filters.publisherId !== undefined) {
        predicates.push(eq(games.publisherId, filters.publisherId));
    }

    const query = baseGamesQuery(db);
    const rows = predicates.length > 0
        ? await query.where(and(...predicates)).orderBy(asc(games.title))
        : await query.orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All games ordered by title. */
export async function getAllGames(db: Database): Promise<Game[]> {
    const rows = await baseGamesQuery(db).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
