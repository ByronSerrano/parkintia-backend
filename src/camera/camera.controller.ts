import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete,
  UploadedFile,
  UseInterceptors,
  StreamableFile,
  Res,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CameraService } from './camera.service';
import { ParkingDetectionService } from './parking-detection.service';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
import { CreateParkingZoneDto, UpdateParkingZoneDto, BulkCreateParkingZonesDto } from './dto/parking-zone.dto';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Controller('camera')
export class CameraController {
  private readonly pythonServiceUrl: string;

  constructor(
    private readonly cameraService: CameraService,
    private readonly parkingDetectionService: ParkingDetectionService,
    private readonly configService: ConfigService,
  ) {
    this.pythonServiceUrl = this.configService.get<string>('PYTHON_SERVICE_URL') || 'http://localhost:5000';
  }

  // ========== CAMERA CRUD ==========

  @Post()
  create(@Body() createCameraDto: CreateCameraDto) {
    return this.cameraService.create(createCameraDto);
  }

  @Get()
  findAll() {
    return this.cameraService.findAll();
  }

  // ========== LEGACY ENDPOINTS (must be before :id routes) ==========

  @Get('all-data')
  getAllData() {
    return this.cameraService.findAll();
  }

  @Get('total-space')
  getTotalSpace() {
    return {
      message: 'Space in parking',
      total_count_space: 38
    };
  }

  // ========== VIDEO STREAMING FROM PYTHON SERVICE (BEFORE :id routes) ==========

  @Get('video-feed')
  async videoFeed(
    @Query('cameraId') cameraId: string = 'default',
    @Res() response: Response,
  ) {
    try {
      const pythonResponse = await axios.get(
        `${this.pythonServiceUrl}/api/video/feed?cameraId=${cameraId}`,
        {
          responseType: 'stream',
        }
      );

      response.set({
        'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      pythonResponse.data.pipe(response);
    } catch (error) {
      throw new HttpException(
        'Failed to connect to video service',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('video-control')
  async controlVideo(
    @Body() body: { action: string; cameraId?: string },
  ) {
    try {
      const { action, cameraId = 'default' } = body;
      const response = await axios.post(
        `${this.pythonServiceUrl}/api/video/control`,
        { action, cameraId },
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        'Failed to control video',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get('parking-status-live')
  async getParkingStatusLive(
    @Query('cameraId') cameraId: string = 'default',
  ) {
    try {
      const response = await axios.get(
        `${this.pythonServiceUrl}/api/parking/status?cameraId=${cameraId}`,
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        'Failed to get parking status',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get('zones/default')
  async getDefaultZones() {
    try {
      const response = await axios.get(
        `${this.pythonServiceUrl}/api/zones/default`,
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        'Failed to get default zones',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ========== ROUTES WITH :id PARAMETER (MUST BE AFTER SPECIFIC ROUTES) ==========

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cameraService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCameraDto: UpdateCameraDto) {
    return this.cameraService.update(id, updateCameraDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cameraService.remove(id);
  }

  // ========== PARKING ZONES ==========

  @Post('parking-zones')
  createParkingZone(@Body() createDto: CreateParkingZoneDto) {
    return this.cameraService.createParkingZone(createDto);
  }

  @Post('parking-zones/bulk')
  bulkCreateParkingZones(@Body() bulkDto: BulkCreateParkingZonesDto) {
    return this.cameraService.bulkCreateParkingZones(bulkDto);
  }

  @Get(':cameraId/parking-zones')
  getParkingZones(@Param('cameraId') cameraId: string) {
    return this.cameraService.getParkingZonesByCamera(cameraId);
  }

  @Patch('parking-zones/:zoneId')
  updateParkingZone(
    @Param('zoneId') zoneId: string,
    @Body() updateDto: UpdateParkingZoneDto,
  ) {
    return this.cameraService.updateParkingZone(zoneId, updateDto);
  }

  @Delete('parking-zones/:zoneId')
  deleteParkingZone(@Param('zoneId') zoneId: string) {
    return this.cameraService.deleteParkingZone(zoneId);
  }

  @Delete(':cameraId/parking-zones/all')
  deleteAllZones(@Param('cameraId') cameraId: string) {
    return this.cameraService.deleteAllZonesFromCamera(cameraId);
  }

  // ========== PARKING DETECTION & STATUS ==========

  @Get(':cameraId/parking-status')
  getParkingStatus(@Param('cameraId') cameraId: string) {
    return this.parkingDetectionService.getParkingStatus(cameraId);
  }

  @Post(':cameraId/process-frame')
  @UseInterceptors(FileInterceptor('frame'))
  async processFrame(
    @Param('cameraId') cameraId: string,
    @UploadedFile() file: any,
  ) {
    return this.parkingDetectionService.processFrame(cameraId, file.buffer);
  }

  @Get(':cameraId/stream')
  async streamVideo(
    @Param('cameraId') cameraId: string,
    @Query('source') videoSource: string,
    @Res() response: Response,
  ) {
    response.set({
      'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const stream = this.parkingDetectionService.streamProcessedVideo(
      cameraId,
      videoSource,
    );

    for await (const chunk of stream) {
      response.write(chunk);
    }

    response.end();
  }
}

