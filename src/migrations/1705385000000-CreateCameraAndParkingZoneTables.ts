import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreateCameraAndParkingZoneTables1705385000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Crear tabla cameras
        await queryRunner.createTable(
            new Table({
                name: "cameras",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()",
                    },
                    {
                        name: "name",
                        type: "varchar",
                        isUnique: true,
                    },
                    {
                        name: "description",
                        type: "varchar",
                        isNullable: true,
                    },
                    {
                        name: "streamUrl",
                        type: "varchar",
                        isNullable: true,
                    },
                    {
                        name: "videoFile",
                        type: "varchar",
                        isNullable: true,
                    },
                    {
                        name: "total_parking",
                        type: "int",
                        default: 0,
                    },
                    {
                        name: "isActive",
                        type: "boolean",
                        default: true,
                    },
                    {
                        name: "createdAt",
                        type: "timestamp",
                        default: "now()",
                    },
                    {
                        name: "updatedAt",
                        type: "timestamp",
                        default: "now()",
                    },
                ],
            }),
            true,
        );

        // Crear tabla parking_zones
        await queryRunner.createTable(
            new Table({
                name: "parking_zones",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()",
                    },
                    {
                        name: "name",
                        type: "varchar",
                    },
                    {
                        name: "spaceNumber",
                        type: "int",
                    },
                    {
                        name: "coordinates",
                        type: "jsonb",
                    },
                    {
                        name: "isOccupied",
                        type: "boolean",
                        default: false,
                    },
                    {
                        name: "lastDetectionTime",
                        type: "timestamp",
                        isNullable: true,
                    },
                    {
                        name: "cameraId",
                        type: "uuid",
                    },
                    {
                        name: "createdAt",
                        type: "timestamp",
                        default: "now()",
                    },
                    {
                        name: "updatedAt",
                        type: "timestamp",
                        default: "now()",
                    },
                ],
            }),
            true,
        );

        // Crear foreign key
        await queryRunner.createForeignKey(
            "parking_zones",
            new TableForeignKey({
                columnNames: ["cameraId"],
                referencedColumnNames: ["id"],
                referencedTableName: "cameras",
                onDelete: "CASCADE",
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Eliminar foreign key
        const table = await queryRunner.getTable("parking_zones");
        const foreignKey = table?.foreignKeys.find(
            (fk) => fk.columnNames.indexOf("cameraId") !== -1,
        );
        if (foreignKey) {
            await queryRunner.dropForeignKey("parking_zones", foreignKey);
        }

        // Eliminar tablas
        await queryRunner.dropTable("parking_zones");
        await queryRunner.dropTable("cameras");
    }
}
