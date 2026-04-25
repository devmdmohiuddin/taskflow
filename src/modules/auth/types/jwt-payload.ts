export interface JwtPayload {
  sub: string; // user id
  email: string;
  type: 'access' | 'refresh';
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}
