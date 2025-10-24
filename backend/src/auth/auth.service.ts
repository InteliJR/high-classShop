import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponseDto, LoginDto } from './dto/auth';
import * as bcrypt from 'bcrypt'

@Injectable()
export class AuthService {
    constructor( private readonly prismaService: PrismaService, private jwtService: JwtService ) {}

    async login( data: LoginDto) {
        const user = await this.prismaService.user.findUnique({
            where:{ 
                email: data.email,
            },
        });

        if (!user) {
            throw new ApiResponseDto;
        }

        const passwordMatch = await bcrypt.compare(data.password_hash, user. password_hash);

        if( !passwordMatch ) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const accessToken = await this.jwtService.signAsync({
            id: user.id,
            email: user.email,
            name: user.name,
        })

        return {
            accessToken
        }
    }
}
