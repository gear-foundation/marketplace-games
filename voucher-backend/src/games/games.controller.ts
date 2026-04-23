import { Controller, Get } from '@nestjs/common';
import { GamesService } from './games.service';

@Controller('games')
export class GamesController {
  constructor(private readonly service: GamesService) {}

  @Get()
  listGames() {
    return this.service.listGames();
  }
}
