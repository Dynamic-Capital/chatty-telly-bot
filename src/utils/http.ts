import axios from 'axios';
import { httpsAgent } from './http-ca';

export const http = axios.create({ httpsAgent });
