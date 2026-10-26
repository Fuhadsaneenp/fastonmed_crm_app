"use client";
import {useState} from "react";
import {apiRequest} from "@/lib/api-client";
import {useRouter} from "next/navigation";
type Plugin={checkPermissions:()=>Promise<{receive:string}>;requestPermissions:()=>Promise<{receive:string}>;register:()=>Promise<void>;createChannel:(options:object)=>Promise<void>;addListener:(event:string,callback:(value:any)=>void)=>Promise<{remove:()=>Promise<void>}>};
export default function AndroidPushSettings(){
 const router=useRouter(); const [status,setStatus]=useState(""),[busy,setBusy]=useState(false);
 const enable=async()=>{setBusy(true);try{
 const native=(window as any).Capacitor;const push:Plugin=native?.Plugins?.PushNotifications;
 if(native?.getPlatform?.()!=="android"||!push){setStatus("Open the installed Android app to enable push notifications.");return;}
 let permission=await push.checkPermissions();if(permission.receive==='prompt')permission=await push.requestPermissions();
 if(permission.receive!=='granted'){setStatus("Notifications are blocked. Enable them in Android Settings → Apps → FastonMed CRM → Notifications.");return;}
 await push.createChannel({id:'crm-updates',name:'CRM updates',importance:4,visibility:0});
 await push.addListener('registration',async(value)=>{try{await apiRequest('/api/push/devices',{method:'POST',body:JSON.stringify({token:value.value,platform:'android'})});setStatus('This device is registered for notifications.');}catch{setStatus('Device registration failed. Check that the notification API is deployed, then retry.');}});
 await push.addListener('registrationError',()=>setStatus('Push registration failed. Firebase must be configured in the Android build.'));
 await push.addListener('pushNotificationActionPerformed',event=>{const url=event.notification?.data?.url;if(typeof url==='string'&&url.startsWith('/')&&!url.startsWith('//')&&!url.includes('\\'))router.push(url);});
 await push.register();setStatus('Permission granted. Registering this device…');
 }catch{setStatus('Could not enable notifications. Check the Firebase setup and rebuild the Android app.');}finally{setBusy(false)}};
 return <section className="profile-panel"><h2>Push notifications</h2><p>Receive updates on your Android phone, even when the app is closed.</p><button type="button" disabled={busy} onClick={()=>void enable()}>{busy?'Enabling…':'Enable Android notifications'}</button>{status&&<p role="status">{status}</p>}</section>;
}
