import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
const local={target:'http://127.0.0.1:4317',changeOrigin:true,headers:{origin:'http://127.0.0.1:4317'}};
export default defineConfig({plugins:[react()],server:{host:'127.0.0.1',proxy:{'/api':local,'/assets':local,'/backups':local}}});
