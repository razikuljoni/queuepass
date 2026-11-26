import { Module } from '@nestjs/common';
import { OrgsService } from './orgs.service';
import { OrgsController } from './orgs.controller';
import { PublicDirectoryController } from './public-directory.controller';

@Module({ providers: [OrgsService], controllers: [OrgsController, PublicDirectoryController], exports: [OrgsService] })
export class OrgsModule {}
