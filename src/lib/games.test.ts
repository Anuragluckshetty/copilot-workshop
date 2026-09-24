import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getAllCategories,
    getAllPublishers,
    getFilteredGames,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('returns filter options ordered alphabetically', async () => {
        await db.insert(categories).values([
            { name: 'Strategy', description: 'cat' },
            { name: 'Action', description: 'cat' },
        ]);
        await db.insert(publishers).values([
            { name: 'Zed Games', description: 'pub' },
            { name: 'Alpha Games', description: 'pub' },
        ]);

        expect((await getAllCategories(db)).map((category) => category.name)).toEqual(['Action', 'Strategy']);
        expect((await getAllPublishers(db)).map((publisher) => publisher.name)).toEqual(['Alpha Games', 'Zed Games']);
    });

    it('filters games by one or more categories', async () => {
        const categoryRows = await db.insert(categories).values([
            { name: 'Strategy', description: 'cat' },
            { name: 'Action', description: 'cat' },
        ]).returning({ id: categories.id });
        const [publisher] = await db.insert(publishers).values({ name: 'Pub One', description: 'pub' }).returning({ id: publishers.id });
        await db.insert(games).values([
            { title: 'Action Game', description: 'a', starRating: 4, categoryId: categoryRows[1].id, publisherId: publisher.id },
            { title: 'Strategy Game', description: 's', starRating: 4, categoryId: categoryRows[0].id, publisherId: publisher.id },
            { title: 'Puzzle Game', description: 'p', starRating: 4, categoryId: categoryRows[0].id, publisherId: publisher.id },
        ]);

        const filtered = await getFilteredGames(db, { categoryIds: categoryRows.map((category) => category.id) });
        expect(filtered.map((game) => game.title)).toEqual(['Action Game', 'Puzzle Game', 'Strategy Game']);
    });

    it('combines category and publisher filters', async () => {
        const [category] = await db.insert(categories).values({ name: 'Strategy', description: 'cat' }).returning({ id: categories.id });
        const publisherRows = await db.insert(publishers).values([
            { name: 'Pub One', description: 'pub' },
            { name: 'Pub Two', description: 'pub' },
        ]).returning({ id: publishers.id });
        await db.insert(games).values([
            { title: 'Matching Game', description: 'match', starRating: 4, categoryId: category.id, publisherId: publisherRows[0].id },
            { title: 'Other Publisher', description: 'other', starRating: 4, categoryId: category.id, publisherId: publisherRows[1].id },
        ]);

        const filtered = await getFilteredGames(db, {
            categoryIds: [category.id],
            publisherId: publisherRows[0].id,
        });
        expect(filtered.map((game) => game.title)).toEqual(['Matching Game']);
    });

    it('returns all games for empty filters and no games for a non-matching filter', async () => {
        await seedGames(db, 2);
        expect((await getFilteredGames(db, {})).map((game) => game.title)).toEqual(['Game 01', 'Game 02']);
        expect(await getFilteredGames(db, { categoryIds: [99999] })).toEqual([]);
    });
});
