document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM fully loaded and parsed.");
    
    // Core elements
    const chatBody = document.querySelector(".chat-body");
    const messageInput = document.querySelector(".message-input");
    const sendMessageButton = document.querySelector("#send-message");
    const chatbotToggler = document.querySelector("#chatbot-toggler");
    const closeChatBot = document.querySelector("#close-chatbot");
    
    // File upload elements
    const fileInput = document.querySelector("#file-input");
    const fileUploadBtn = document.querySelector("#file-upload");
    const fileCancelBtn = document.querySelector("#file-cancel");
    const filePreview = document.querySelector("#file-preview");
    const fileUploadWrapper = document.querySelector(".file-upload-wrapper");
    
    // Emoji elements
    const emojiButton = document.querySelector("#emoji-button");
    
    console.log("Elements selected: ", { 
        chatBody, messageInput, sendMessageButton, chatbotToggler, closeChatBot,
        fileInput, fileUploadBtn, fileCancelBtn, emojiButton 
    });

    const API_KEY = "AIzaSyDryqLg9GkyzreifUvL9nMreTDGitR90RI";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    let chatHistory = []; // Store chat history
    let selectedFile = null;

    // Function to create a message element
    const createMessageElement = (content, classNames) => {
        const div = document.createElement("div");
        div.classList.add("message");
        
        // Handle multiple classes by splitting on whitespace and adding each class separately
        if (classNames) {
            classNames.split(" ").forEach(className => {
                if (className.trim()) {
                    div.classList.add(className.trim());
                }
            });
        }
        
        div.innerHTML = content;
        return div;
    };

    // Convert file to base64
    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    };

    // Send user message
    const handleOutgoingMessage = async (e) => {
        e.preventDefault();

        const userMessage = messageInput.value.trim();
        if (!userMessage && !selectedFile) return;

        // Create message content
        let messageContent = `<div class="message-text">${userMessage}</div>`;
        
        // If there's a file, add it to the message
        let imageData = null;
        if (selectedFile) {
            // Create a URL for the image preview in the chat
            const imageUrl = URL.createObjectURL(selectedFile);
            messageContent += `<img src="${imageUrl}" class="attachment" alt="Attachment">`;
            
            // Also prepare the image data for the API
            try {
                imageData = await fileToBase64(selectedFile);
            } catch (error) {
                console.error("Error converting image to base64:", error);
            }
        }

        // Add user message to chat history
        chatHistory.push({ 
            role: "user", 
            text: userMessage,
            // Include a note about the image if there is one
            imageNote: selectedFile ? `[Attached image: ${selectedFile.name}]` : null
        });

        const userMessageDiv = createMessageElement(messageContent, "user-message");
        chatBody.appendChild(userMessageDiv);

        messageInput.value = "";
        
        // Reset file upload
        if (selectedFile) {
            resetFileUpload();
        }

        chatBody.scrollTop = chatBody.scrollHeight;

        setTimeout(() => {
            const thinkingContent = `
                <img class="bot-avatar" src="ai.png" width="50" height="50">
                <div class="message-text">
                    <div class="thinking-indicator">
                        <div class="dot"></div>
                        <div class="dot"></div>
                        <div class="dot"></div>
                    </div>
                </div>
            `;
            const incomingMessageDiv = createMessageElement(thinkingContent, "bot-message thinking");
            chatBody.appendChild(incomingMessageDiv);
            chatBody.scrollTop = chatBody.scrollHeight;

            generateBotResponse(incomingMessageDiv, imageData);
        }, 600);
    };

    // API call to get bot response
    const generateBotResponse = async (incomingMessageDiv, imageData) => {
        const messageElement = incomingMessageDiv.querySelector(".message-text");

        // Build request body
        let requestBody = {
            contents: [{
                parts: []
            }]
        };
        
        // Add text parts from chat history
        chatHistory.forEach(msg => {
            if (msg.role === "user") {
                // Include both message text and image note if available
                const textPart = msg.text ? { text: msg.text } : null;
                const notePart = msg.imageNote ? { text: msg.imageNote } : null;
                
                if (textPart) {
                    requestBody.contents[0].parts.push(textPart);
                }
                if (notePart) {
                    requestBody.contents[0].parts.push(notePart);
                }
            } else if (msg.role === "bot") {
                requestBody.contents[0].parts.push({ text: msg.text });
            }
        });
        
        // Add the image to the current request if available
        if (imageData) {
            // Extract the mime type and base64 data
            const mimeMatch = imageData.match(/^data:([^;]+);base64,(.+)$/);
            if (mimeMatch) {
                const [_, mimeType, base64Data] = mimeMatch;
                
                // Add image part to the request
                requestBody.contents[0].parts.push({
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                    }
                });
                
                console.log("Added image to request with MIME type:", mimeType);
            }
        }

        console.log("Sending request to API:", JSON.stringify(requestBody).substring(0, 200) + "...");

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();
            console.log("API response:", data);
            
            const botResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't understand that.";
            
            chatHistory.push({ role: "bot", text: botResponse }); // Store bot response

            // Remove the thinking class and update the message
            incomingMessageDiv.classList.remove("thinking");
            messageElement.innerHTML = botResponse;
        } catch (error) {
            console.error("Error fetching bot response:", error);
            incomingMessageDiv.classList.remove("thinking");
            messageElement.innerHTML = "Error: Unable to fetch response. " + error.message;
        }
    };

    // File Upload Functionality
    fileUploadBtn.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            selectedFile = e.target.files[0];
            
            // Verify this is an image file
            if (!selectedFile.type.startsWith('image/')) {
                alert('Please select an image file');
                resetFileUpload();
                return;
            }
            
            console.log("File selected:", selectedFile.name, selectedFile.type, selectedFile.size);
            
            filePreview.src = URL.createObjectURL(selectedFile);
            filePreview.style.display = "block";
            fileCancelBtn.style.display = "block";
            fileUploadBtn.style.display = "none";
            fileUploadWrapper.classList.add("file-uploaded");
        }
    });

    // Function to reset file upload
    const resetFileUpload = () => {
        selectedFile = null;
        fileInput.value = "";
        filePreview.src = "";
        filePreview.style.display = "none";
        fileCancelBtn.style.display = "none";
        fileUploadBtn.style.display = "block";
        fileUploadWrapper.classList.remove("file-uploaded");
    };

    fileCancelBtn.addEventListener("click", resetFileUpload);

    // SIMPLER EMOJI PICKER IMPLEMENTATION
    // Create an emoji list container
    const emojiContainer = document.createElement("div");
    emojiContainer.className = "emoji-container";
    emojiContainer.style.display = "none";
    document.querySelector(".chat-form").appendChild(emojiContainer);
    
    // Common emojis
    const commonEmojis = [
        "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","🫠","😉","😊","😇","🥰","😍","🤩","😘","😚","😙",
        "🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🫢","🫣","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","🤒","🤕","🤠","🥳","😎","☹️","😮","😯",
"😳","🥺","🥹","😥","😭","😖","😣","😞","😓","😩","😡","💀","☠️","🤍", "👍", "👎", 
         "🔥", "🎉", "👋", "🙏", "✅", "⭐", "🌟",
        "📷", "🎈", "🎁", "🚀", "💯", "💪", "🤝", "👏"
    ];
    
    // Create emoji grid
    commonEmojis.forEach(emoji => {
        const emojiSpan = document.createElement("span");
        emojiSpan.className = "emoji-item";
        emojiSpan.textContent = emoji;
        emojiSpan.style.cursor = "pointer";
        emojiSpan.style.padding = "5px";
        emojiSpan.style.fontSize = "20px";
        
        emojiSpan.addEventListener("click", () => {
            // Insert emoji at cursor position
            const cursorPos = messageInput.selectionStart;
            const textBeforeCursor = messageInput.value.substring(0, cursorPos);
            const textAfterCursor = messageInput.value.substring(cursorPos);
            
            messageInput.value = textBeforeCursor + emoji + textAfterCursor;
            
            // Set cursor position after inserted emoji
            messageInput.selectionStart = cursorPos + emoji.length;
            messageInput.selectionEnd = cursorPos + emoji.length;
            messageInput.focus();
            
            // Hide emoji container
            emojiContainer.style.display = "none";
        });
        
        emojiContainer.appendChild(emojiSpan);
    });
    
    // Style the emoji container
    emojiContainer.style.position = "absolute";
    emojiContainer.style.bottom = "60px";
    emojiContainer.style.left = "10px";
    emojiContainer.style.backgroundColor = "#fff";
    emojiContainer.style.border = "1px solid #ccc";
    emojiContainer.style.borderRadius = "5px";
    emojiContainer.style.padding = "10px";
    emojiContainer.style.display = "none";
    emojiContainer.style.maxWidth = "400px";
    emojiContainer.style.flexWrap = "wrap";
    emojiContainer.style.display = "none";
    emojiContainer.style.zIndex = "1000";
	emojiContainer.style.maxHeight = "200px"; 
emojiContainer.style.overflowY = "auto"; 

    
    // Toggle emoji container visibility
    emojiButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (emojiContainer.style.display === "none") {
            emojiContainer.style.display = "flex";
        } else {
            emojiContainer.style.display = "none";
        }
    });
    
    // Close emoji container when clicking outside
    document.addEventListener("click", (e) => {
        if (!emojiButton.contains(e.target) && !emojiContainer.contains(e.target)) {
            emojiContainer.style.display = "none";
        }
    });

    // Event Listeners
    sendMessageButton.addEventListener("click", handleOutgoingMessage);
    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleOutgoingMessage(e);
        }
    });

    chatbotToggler.addEventListener("click", () => document.body.classList.toggle("show-chatbot"));
    closeChatBot.addEventListener("click", () => document.body.classList.remove("show-chatbot"));
});