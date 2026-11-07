import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(here,'data');const lock=path.join(root,'server.lock');const port=Number(process.env.PORT||4317);
try{
 if(!fs.existsSync(lock)){console.log('Кабинет не запущен.');process.exit(0)}
 const pid=Number(fs.readFileSync(lock,'utf8'));if(!Number.isSafeInteger(pid)||pid<=0)throw Error('Некорректный файл блокировки');
 let alive=true;try{process.kill(pid,0)}catch(e){if(e.code!=='ESRCH')throw e;alive=false}
 if(!alive){fs.unlinkSync(lock);console.log('Прежний процесс уже остановлен.');process.exit(0)}
 const response=await fetch('http://127.0.0.1:'+port+'/api/state',{signal:AbortSignal.timeout(3000)});if(!response.ok)throw Error('Кабинет не отвечает');const info=await response.json();
 if(path.resolve(info.root)!==path.join(root,'current'))throw Error('По этому адресу работает другой проект. Он не будет остановлен.');
 // Verify that the PID in the lock really owns this listening port.
 if(process.platform!=='win32')throw Error('Этот файл перезапуска предназначен для Windows. Используйте Ctrl+C в консоли.');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Неверный порт');
 const command="$owners=@(Get-NetTCPConnection -LocalPort "+port+" -State Listen -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique); if($owners.Count -ne 1){exit 2}; $processInfo=Get-Process -Id $owners[0] -ErrorAction Stop; if($processInfo.ProcessName -ne 'node'){exit 3}; [Console]::Write($owners[0])";
 const owner=Number(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true}).trim());
 if(owner!==pid)throw Error('Процесс из файла блокировки не совпадает с процессом кабинета. Автоматическая остановка отменена.');
 console.log('Останавливаю кабинет. Рукописи и резервные копии остаются на месте.');process.kill(pid,'SIGTERM');
 let stopped=false;for(let i=0;i<50;i++){try{process.kill(pid,0)}catch(e){if(e.code==='ESRCH'){stopped=true;break}throw e}await new Promise(resolve=>setTimeout(resolve,100))}
 if(!stopped)throw Error('Не удалось дождаться остановки. Закройте прежнюю консоль приложения.');
 if(fs.existsSync(lock)&&Number(fs.readFileSync(lock,'utf8'))===pid)fs.unlinkSync(lock);
 console.log('Кабинет остановлен.');
}catch(error){console.error('Не удалось перезапустить кабинет: '+error.message+'\nЗакройте его прежнюю консоль или перезагрузите компьютер, затем запустите START.bat.');process.exitCode=1}
