import { AuthTokenStorage } from "./http.token.store";

export class AuthTokenStorageImp implements AuthTokenStorage{
    token: string | undefined;
    id: string | undefined;

    constructor(readonly tokenStorageId: string, readonly userStorageId: string) {}
  
    public get authToken(): string | undefined {
      if (!this.token) {
        if (typeof window !== 'undefined') {
            this.token = localStorage.getItem(this.tokenStorageId) || undefined;
        }
      }
      
      return this.token;
    }
  
    public set authToken(token: string | undefined) {
      if (token !== undefined) {
        this.token = token;

        if(typeof window !== 'undefined')
          localStorage.setItem(this.tokenStorageId, token);
      } else if(typeof window !== 'undefined') {
        localStorage.removeItem(this.tokenStorageId);
      }
    }
  
    public get userId(): string | undefined {
      if (!this.id) {
        if (typeof window !== 'undefined') {
            this.id = localStorage.getItem(this.userStorageId) || undefined;
        }
      }
        
      return this.id;
    }
  
    public set userId(userId: string | undefined) {
      if (userId !== undefined) {
       this.id = userId;

       if(typeof window !== 'undefined')
          localStorage.setItem(this.userStorageId, userId);
      } else if(typeof window !== 'undefined') {
       localStorage.removeItem(this.userStorageId);
      }
    }
  }
  