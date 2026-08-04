import env from './env.js';

export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Base Backend API Documentation',
    version: '1.0.0',
    description: 'Interactive API dashboard documenting authentication, caching, rate limiting, and health monitoring endpoints.'
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}`,
      description: 'Local Development Server'
    }
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'refreshToken',
        description: 'Refresh token stored securely in HttpOnly cookie.'
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Authorization header containing JWT access token: "Bearer <token>".'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['USER', 'ADMIN'] },
          profilePic: { type: 'string', format: 'uri', nullable: true },
          linkedin: { type: 'string', format: 'uri', nullable: true },
          github: { type: 'string', format: 'uri', nullable: true },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          traceId: { type: 'string', format: 'uuid' }
        }
      }
    }
  },
  paths: {
    '/api/auth/register': {
      post: {
        summary: 'Register a new user',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'username', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'user@example.com' },
                  username: { type: 'string', minLength: 3, maxLength: 30, example: 'testuser' },
                  password: { type: 'string', minLength: 6, example: 'Password123' }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'User registered successfully.' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' }
                      }
                    }
                  }
                }
              }
            }
          },
          400: {
            description: 'Validation failure or bad payload',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          },
          409: {
            description: 'Email or Username conflict',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          }
        }
      }
    },
    '/api/auth/login': {
      post: {
        summary: 'Authenticate and retrieve session tokens',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'user@example.com' },
                  password: { type: 'string', example: 'Password123' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Authentication successful',
            headers: {
              'Set-Cookie': {
                schema: { type: 'string', example: 'refreshToken=...; HttpOnly; Secure' },
                description: 'Stores the rotate-token in secure cookies.'
              }
            },
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Authentication successful.' },
                    data: {
                      type: 'object',
                      properties: {
                        accessToken: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          401: {
            description: 'Invalid credentials or locked account',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          }
        }
      }
    },
    '/api/auth/logout': {
      post: {
        summary: 'Invalidate current session and clear cookies',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Logout completed'
          }
        }
      }
    },
    '/api/auth/refresh': {
      post: {
        summary: 'Renew access token using HTTP refresh cookie',
        tags: ['Authentication'],
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: 'Access token regenerated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        accessToken: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          403: {
            description: 'Refresh token invalid, reuse detected, or session expired',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          }
        }
      }
    },
    '/api/auth/profile': {
      get: {
        summary: 'Fetch logged-in user profile details',
        tags: ['Profile'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Profile details fetched successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' }
                      }
                    }
                  }
                }
              }
            }
          },
          401: { description: 'Missing or malformed Authorization token' }
        }
      },
      put: {
        summary: 'Update user profile social attributes',
        tags: ['Profile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  profilePic: { type: 'string', format: 'uri', nullable: true },
                  linkedin: { type: 'string', format: 'uri', nullable: true },
                  github: { type: 'string', format: 'uri', nullable: true }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Profile updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/change-password': {
      post: {
        summary: 'Change account password (authenticated)',
        tags: ['Profile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['oldPassword', 'newPassword'],
                properties: {
                  oldPassword: { type: 'string' },
                  newPassword: { type: 'string', minLength: 6 }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Password changed successfully' },
          400: { description: 'Old password invalid or password validation rules failed' }
        }
      }
    },
    '/api/health': {
      get: {
        summary: 'Retrieve system health and connectivity telemetry status',
        tags: ['Diagnostics'],
        responses: {
          200: {
            description: 'Telemetry status report',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                    checks: {
                      type: 'object',
                      properties: {
                        redis: {
                          type: 'object',
                          properties: {
                            status: { type: 'string', example: 'healthy' },
                            connected: { type: 'boolean', example: true }
                          }
                        },
                        database: {
                          type: 'object',
                          properties: {
                            status: { type: 'string', example: 'healthy' },
                            connected: { type: 'boolean', example: true }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
