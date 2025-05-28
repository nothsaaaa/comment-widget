# nothsaaaa comment widget


running
1. change the secret in ./app.js on line 22
2. `node app.js`

# screenshots
![image](https://github.com/user-attachments/assets/2e4bed6e-ec0a-46bb-b490-d318d6c9ee43)
![image](https://github.com/user-attachments/assets/93e51ce8-33dd-4306-8b25-b0640e179aed)
![image](https://github.com/user-attachments/assets/334e3fc4-81a8-4b37-8b7a-f815f158a25b)

### notes
in ./routes/admin.js you will notice i enable `httpOnly` and didnt set `secure` to any value<br>
i have no clue what these do and im too scared to play with them<br>
those should be the only values you need to change for production, please open a pull request if you know correctly<br>
<br>
this app uses session based authentication also

