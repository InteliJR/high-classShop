import { IsEmail } from 'class-validator';

export class InviteAdvisorDto {
  @IsEmail({}, { message: 'E-mail do assessor inválido' })
  email: string;
}
