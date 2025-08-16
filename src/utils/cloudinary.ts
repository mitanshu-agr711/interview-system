

import {v2 as cloudinary} from "cloudinary";
//v2 ka custum name cloudinary kar dia
import fs from "fs"

          
cloudinary.config({ 
  cloud_name:process.env.CLOUDINARY_CLOUD_NAME, 
  api_key:process.env.CLOUDINARY_API_KEY , 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadCloudinary=async(localFilePath: string)=>{
     try {
        if(!localFilePath) return null
        //now upload the file
       const content=await  cloudinary.uploader.upload(localFilePath,
            {
                resource_type:"auto"
            })
            console.log("fileis uploaded on cloudinary",content.url);
            fs.unlinkSync(localFilePath)//unlike the file
            return content
     }catch(error){
           fs.unlinkSync(localFilePath)//unlike the file
           //remove the locally saved tempory file as upload
           //operation got failed
           return null;
     }
}
export {uploadCloudinary}