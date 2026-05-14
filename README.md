# Life Commander MTG

A modern, responsive, and multiplayer web application to track life totals, commander damage, poison counters, and mana pools in your Magic: The Gathering games (specifically tailored for the Commander / EDH format).

The application synchronizes the game state in real-time across all connected devices using WebSockets.

## 🚀 Key Features

- **Real-Time Synchronization:** Use your phone while your friends use theirs; all changes (life totals, damage, etc.) are instantly reflected on everyone's screens in the same room.
- **Commander Damage:** Track the combat damage received from each rival commander individually, utilizing a compact and intuitive interface.
- **Comprehensive Tracking:** Built-in support for Commander Tax, Poison counters, and Mana Pool tracking.
- **Scryfall Integration:** Search for your commander by name, and the app will automatically fetch and display the original card art as your profile background.
- **Game Log:** A detailed event history (who attacked whom, life changes, dice rolls, and mana pool variations) so you never lose track of what happened.
- **Mobile-First Design:** Responsive interface featuring a 2x2 grid layout on mobile devices, seamlessly fitting all 4 players on a single screen without the need to scroll.

## 🛠️ Technologies

- **Frontend:** HTML5, Vanilla CSS, JavaScript (Vanilla).
- **Backend:** Node.js, Express.
- **WebSockets:** Socket.io for bidirectional communication and multiplayer rooms.
- **External APIs:** [Scryfall API](https://scryfall.com/docs/api) for card searches and imagery.

## 📥 Installation & Local Usage

To run this project on your local network (ideal for playing with friends connected to the same WiFi):

1. **Prerequisites:**
   Make sure you have [Node.js](https://nodejs.org/) installed (version 18.x or higher is recommended).

2. **Clone and Install:**
   ```bash
   git clone <your-repository-url>
   cd LifeCounter_MTG
   npm install
   ```

3. **Start the Server:**
   ```bash
   npm start
   ```
   *(You can also run `npm run dev` if you are making changes to the code and want to use nodemon for hot-reloading).*

4. **Play:**
   Open your browser and navigate to `http://localhost:3000`. 
   For your friends to connect using their phones, find out your computer's local IP address (e.g., `192.168.1.15`) and tell them to navigate to `http://192.168.1.15:3000`.

## 🌐 Cloud Deployment (Production)

The project includes configuration files to be easily deployed on cloud platforms like **Render** or **Railway**. 
- For **Render**, the basic configuration is already set up in the `render.yaml` file.
- Make sure that ports and start commands (`npm start`) are correctly mapped in your chosen platform.

## 🤝 Contributing

If you wish to improve the application, feel free to fork the project and submit a Pull Request with your enhancements. All contributions are welcome!
