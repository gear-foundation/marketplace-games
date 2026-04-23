import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum ArcadeGameStatus {
  Live = 'live',
  Soon = 'soon',
  Hidden = 'hidden',
}

@Entity({ name: 'arcade_game' })
export class ArcadeGame {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: false, unique: true })
  slug!: string;

  @Column({ nullable: false })
  title!: string;

  @Column({ nullable: false })
  description!: string;

  @Column({ name: 'frontend_url', nullable: true })
  frontendUrl!: string | null;

  @Column({ name: 'contract_address', nullable: true })
  contractAddress!: string | null;

  @Column({ name: 'image_url', nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  tags!: string[];

  @Column({ type: 'enum', enum: ArcadeGameStatus, default: ArcadeGameStatus.Soon })
  status!: ArcadeGameStatus;

  @Column({ name: 'sort_order', nullable: false, default: 0 })
  sortOrder!: number;

  @Column({
    name: 'created_at',
    type: 'timestamp without time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp without time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;
}
