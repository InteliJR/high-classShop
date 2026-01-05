import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendInvitationDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
