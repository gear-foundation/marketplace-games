import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GamesService } from './games.service';
import { ToggleGameVoteDto } from './dto/toggle-game-vote.dto';

const GAMES_GET_THROTTLE = { default: { limit: 60, ttl: 60000 } };
const GAME_VOTE_TOGGLE_THROTTLE = { default: { limit: 30, ttl: 60000 } };

@Controller('games')
export class GamesController {
  constructor(private readonly service: GamesService) {}

  @Get()
  @Throttle(GAMES_GET_THROTTLE)
  listGames() {
    return this.service.listGames();
  }

  @Get('votes')
  @Throttle(GAMES_GET_THROTTLE)
  getVotes(
    @Query('slugs') slugsRaw = '',
    @Query('account') account?: string,
  ) {
    const slugs = slugsRaw
      .split(',')
      .map((slug) => slug.trim())
      .filter(Boolean);
    return this.service.getVotes(slugs, account?.trim() || undefined);
  }

  @Post(':slug/votes/toggle')
  @Throttle(GAME_VOTE_TOGGLE_THROTTLE)
  toggleVote(
    @Param('slug') slug: string,
    @Body() body: ToggleGameVoteDto,
  ) {
    return this.service.toggleVote(slug, body.account.trim());
  }
}
