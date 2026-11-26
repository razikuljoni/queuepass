import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators';

class RegisterDto {
  @IsString() orgName!: string;
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsString() phone?: string;
}
class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}
class PinLoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(4) pin!: string;
}
class StaffDto {
  @IsEmail() email!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsIn(['branch_manager', 'counter', 'viewer']) role!: string;
  branchIds!: string[];
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsString() pin?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register') register(@Body() dto: RegisterDto) { return this.auth.registerOwner(dto); }
  @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto.email, dto.password); }
  @Post('pin-login') pinLogin(@Body() dto: PinLoginDto) { return this.auth.pinLogin(dto.email, dto.pin); }

  @Post('staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'branch_manager')
  createStaff(@CurrentUser() user: JwtUser, @Body() dto: StaffDto) {
    return this.auth.createStaff(user.orgId, dto);
  }
}
