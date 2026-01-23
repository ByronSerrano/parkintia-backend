import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
// import * as fs from 'fs';
// import * as path from 'path';

dotenv.config();

const configService = new ConfigService();
// const dbSslFile = configService.get<string>('DB_SSL_FILE') || 'ca-certificate.crt';

export const dataBaseConfig: DataSourceOptions = {
  type: 'postgres',
  host: configService.get<string>('DB_HOST'),
  port: configService.get<number>('DB_PORT'),
  username: configService.get<string>('DB_USER'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_NAME'),
  entities: [
    __dirname + '/../**/*.entity{.ts,.js}',
    __dirname + '/../**/entity/*.entity{.ts,.js}',
    __dirname + '/../**/entities/*.entity{.ts,.js}',
  ],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: true,
  ssl: {
    rejectUnauthorized: false,
  },
};

const dataSource = new DataSource(dataBaseConfig);

export default dataSource;
