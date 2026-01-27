import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  // Configuración del usuario demo
  private readonly DEMO_USER = {
    email: 'demo@parkintia.com',
    username: 'Usuario Demo',
    password: 'demo123',
    role: 'admin',
  };

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Se ejecuta al iniciar el módulo.
   * Crea el usuario demo si no existe en la base de datos.
   */
  async onModuleInit() {
    await this.ensureDemoUserExists();
  }

  /**
   * Verifica si el usuario demo existe, si no lo crea.
   */
  private async ensureDemoUserExists(): Promise<void> {
    try {
      const existingUser = await this.userRepository.findOne({
        where: { email: this.DEMO_USER.email },
      });

      if (!existingUser) {
        this.logger.log('Usuario demo no encontrado. Creando usuario demo...');
        
        const hashedPassword = await bcrypt.hash(this.DEMO_USER.password, 10);
        
        const demoUser = this.userRepository.create({
          email: this.DEMO_USER.email,
          username: this.DEMO_USER.username,
          password: hashedPassword,
          role: this.DEMO_USER.role,
          status: true,
        });

        await this.userRepository.save(demoUser);
        this.logger.log(`✅ Usuario demo creado exitosamente: ${this.DEMO_USER.email}`);
      } else {
        this.logger.log(`✅ Usuario demo ya existe: ${this.DEMO_USER.email}`);
      }
    } catch (error) {
      this.logger.error('Error al crear usuario demo:', error.message);
    }
  }


  async create(createUserDto: CreateUserDto) {
    const { email, username, password, role } = createUserDto;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.userRepository.create({
      email,
      username,
      password: hashedPassword,
      role,
      status: true,
    });

    return this.userRepository.save(user);
  }

  async findAll() {
    const users = await this.userRepository.find();

    if (!users || users.length === 0) {
      this.logger.warn('No users found');
      return [];
    }

    return users;
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
    });
    if (!user) {
      this.logger.error(`User with ID ${id} not found`);
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findOneByEmail(email: string) {
    const user = await this.userRepository.findOne({
      where: { email },
    });
    if (!user) {
      this.logger.error(`User with email ${email} not found`);
      throw new NotFoundException(`User with email ${email} not found`);
    }
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = this.findOne(id);

    if (!user) {
      this.logger.error(`User with ID ${id} not found`);
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.update(id, updateUserDto);

    const newUser = await this.userRepository.findOne({ where: { id } });

    return newUser;
  }

  async remove(id: number) {
    const user = await this.findOne(id);

    if (!user) {
      this.logger.error(`User with ID ${id} not found`);
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.update(id, { status: false });

    const message = `User with id: ${id}, removed successfully`;
    this.logger.log(message);

    return {
      message,
      user: await this.userRepository.findOne({ where: { id } }),
    };
  }

  async activateUser(id: number) {
    const user = await this.findOne(id);

    if (!user) {
      this.logger.error(`User with ID ${id} not found`);
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.update(id, { status: true });

    const message = `User with id: ${id}, activated successfully`;

    return {
      message,
      user: await this.userRepository.findOne({ where: { id } }),
    };
  }

  // ========== ESTADÍSTICAS ==========

  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    usersByRole: Record<string, number>;
  }> {
    const users = await this.userRepository.find();

    const activeUsers = users.filter(user => user.status === true).length;
    const inactiveUsers = users.filter(user => user.status === false).length;

    // Contar usuarios por rol
    const usersByRole: Record<string, number> = {};
    users.forEach(user => {
      const role = user.role || 'undefined';
      usersByRole[role] = (usersByRole[role] || 0) + 1;
    });

    return {
      totalUsers: users.length,
      activeUsers,
      inactiveUsers,
      usersByRole,
    };
  }
}
