import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArcadeGame } from '../entities/arcade-game.entity';
import { ArcadeGameVote } from '../entities/arcade-game-vote.entity';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';

@Module({
  imports: [TypeOrmModule.forFeature([ArcadeGame, ArcadeGameVote])],
  controllers: [GamesController],
  providers: [GamesService],
})
export class GamesModule {}
