import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'arcade_game_vote' })
export class ArcadeGameVote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'game_slug', nullable: false })
  gameSlug!: string;

  @Column({ name: 'voter_address', nullable: false })
  voterAddress!: string;

  @Column({
    name: 'created_at',
    type: 'timestamp without time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
