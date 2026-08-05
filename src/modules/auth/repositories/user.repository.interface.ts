export interface IUserRepository {
    findById(id: string): Promise<any | null>;
    findByEmail(email: string): Promise<any | null>;
    findByResetToken(token: string): Promise<any | null>;
    create(data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
    updateByEmail(email: string, data: any): Promise<any>;
}
