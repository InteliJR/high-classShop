import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { request } from "express";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class jwtGetUserService {
   constructor( private readonly prismaService: PrismaService,
    private jwtService: JwtService,
    ) {}

    async get( data: any) {
        // Pega o token e separa ele do bearer
        const token = request.headers['authorization']?.split(' ')[1];

        if (!token) {
            throw new UnauthorizedException('Invalid token');
        }
    }

}