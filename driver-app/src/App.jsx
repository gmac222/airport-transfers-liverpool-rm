import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import Login from './screens/Login.jsx';
import JobsScreen from './screens/JobsScreen.jsx';
import { getItem, setItem, removeItem } from './storage.js';
import { registerPush } from './push.js';

export default function App() {
  const [authed, setAuthed] = useState(null);
  const [driverName, setDriverName] = useState('');

  useEffect(() => {
    (async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#0E2747' });
        } catch {}
        SplashScreen.hide();
      }
      const flag = await getItem('driverLoggedIn');
      const name = await getItem('driverName');
      if (flag === 'true' && name) {
        setDriverName(name);
        setAuthed(true);
        registerPush();
      } else {
        setAuthed(false);
      }
    })();
  }, []);

  const handleLoggedIn = async (name) => {
    await setItem('driverLoggedIn', 'true');
    await setItem('driverName', name);
    setDriverName(name);
    setAuthed(true);
    registerPush();
  };

  const handleLogout = async () => {
    await removeItem('driverLoggedIn');
    await removeItem('driverName');
    setDriverName('');
    setAuthed(false);
  };

  if (authed === null) return <div className="boot" />;
  if (!authed) return <Login onLoggedIn={handleLoggedIn} />;
  return <JobsScreen driverName={driverName} onLogout={handleLogout} />;
}
