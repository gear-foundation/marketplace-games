import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { ArcadeGame, ArcadeGameStatus } from '../entities/arcade-game.entity';

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(ArcadeGame)
    private readonly gamesRepo: Repository<ArcadeGame>,
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
}
