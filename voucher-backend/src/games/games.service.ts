import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { ArcadeGame, ArcadeGameStatus } from '../entities/arcade-game.entity';
import { ArcadeGameVote } from '../entities/arcade-game-vote.entity';

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(ArcadeGame)
    private readonly gamesRepo: Repository<ArcadeGame>,
    @InjectRepository(ArcadeGameVote)
    private readonly votesRepo: Repository<ArcadeGameVote>,
  ) {}

  async listGames() {
    const games = await this.gamesRepo.find({
      where: { status: Not(ArcadeGameStatus.Hidden) },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    return games.map((game) => ({
      id: game.slug,
      slug: game.slug,
      title: game.title,
      description: game.description,
      url: game.frontendUrl,
      contractAddress: game.contractAddress,
      imageUrl: game.imageUrl,
      tags: game.tags,
      status: game.status,
    }));
  }

  async getVotes(slugs: string[], account?: string) {
    const normalizedSlugs = Array.from(
      new Set(
        slugs
          .map((slug) => slug.trim())
          .filter((slug) => /^[a-z0-9-]{1,64}$/i.test(slug)),
      ),
    ).slice(0, 100);

    if (normalizedSlugs.length === 0) {
      return { counts: {}, liked: [] };
    }

    const counts = Object.fromEntries(
      normalizedSlugs.map((slug) => [slug, 0]),
    ) as Record<string, number>;
    const votableGames = await this.gamesRepo.find({
      select: { slug: true },
      where: { slug: In(normalizedSlugs), status: ArcadeGameStatus.Live },
    });
    const votableSlugs = votableGames.map((game) => game.slug);

    if (votableSlugs.length === 0) {
      return { counts, liked: [] };
    }

    const countRows = await this.votesRepo
      .createQueryBuilder('vote')
      .select('vote.gameSlug', 'gameSlug')
      .addSelect('COUNT(*)::int', 'count')
      .where('vote.gameSlug IN (:...slugs)', { slugs: votableSlugs })
      .groupBy('vote.gameSlug')
      .getRawMany<{ gameSlug: string; count: string }>();

    for (const row of countRows) {
      counts[row.gameSlug] = Number(row.count);
    }

    if (!account) {
      return { counts, liked: [] };
    }

    const likedRows = await this.votesRepo.find({
      select: { gameSlug: true },
      where: { gameSlug: In(votableSlugs), voterAddress: account },
    });

    return {
      counts,
      liked: likedRows.map((vote) => vote.gameSlug),
    };
  }

  async toggleVote(slug: string, account: string) {
    const normalizedSlug = slug.trim();
    const normalizedAccount = account.trim();

    if (!/^[a-z0-9-]{1,64}$/i.test(normalizedSlug)) {
      throw new BadRequestException('invalid_game_slug');
    }

    if (normalizedAccount.length < 3 || normalizedAccount.length > 128) {
      throw new BadRequestException('invalid_account');
    }

    const game = await this.gamesRepo.findOne({
      select: { slug: true },
      where: { slug: normalizedSlug, status: ArcadeGameStatus.Live },
    });

    if (!game) {
      throw new BadRequestException('game_not_votable');
    }

    const existing = await this.votesRepo.findOne({
      where: { gameSlug: normalizedSlug, voterAddress: normalizedAccount },
    });

    if (existing) {
      await this.votesRepo.delete({ id: existing.id });
    } else {
      await this.votesRepo.save(
        this.votesRepo.create({
          gameSlug: normalizedSlug,
          voterAddress: normalizedAccount,
        }),
      );
    }

    const votesCount = await this.votesRepo.count({
      where: { gameSlug: normalizedSlug },
    });

    return {
      gameId: normalizedSlug,
      liked: !existing,
      votesCount,
    };
  }
}
