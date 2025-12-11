import { Request, Response } from "express";
import { Workspace } from "../model/workspace.model.js";



declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}


export const createWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {

    const { title } = req.body;
    const userId = req.userId;

    if (!title) {
      res.status(400).json({ message: "Title is required" });
      return;
    }

    const workspace = await Workspace.create({
      title,
      createdBy: userId,
    });

     res.status(201).json({ message: "Workspace created", workspace });
      return;
  } catch (error) {
    res.status(500).json({ error: "Failed to create workspace" });
    return;
  }
};


export const renameWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = req.params.id;
    const { title } = req.body;
    const userId = req.userId;

    if (!title) {
   res.status(400).json({ message: "Title is required" });
    return;
    }

    const workspace = await Workspace.findOneAndUpdate(
      { _id: workspaceId, createdBy: userId },
      { title },
      { new: true }
    );

    if (!workspace) {
      res.status(404).json({ message: "Workspace not found" });
      return;
    }

    res.status(200).json({ message: "Workspace renamed", workspace });
    return;
  } catch (error) {
    res.status(500).json({ error: "Failed to rename workspace" });
    return;
  }
};



export const deleteWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = req.params.id;
    const userId = req.userId;

    const workspace = await Workspace.findOneAndDelete({
      _id: workspaceId,
      createdBy: userId,
    });
    if (!workspace) {
     res.status(404).json({ message: "Workspace not found" });
      return;
    }
    res.status(200).json({ message: "Workspace deleted" });
    return;       
  } catch (error) {
    res.status(500).json({ error: "Failed to delete workspace" });
    return;
  }
};


export const getWorkspaces = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const workspaces = await Workspace.find({ createdBy: userId })
      .populate("Interviews")
      .exec();
    if (!workspaces || workspaces.length === 0) {
     res.status(404).json({ message: "No workspaces found" });
     return;
    }
    res.status(200).json({ workspaces });
    return;
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch workspaces" });
    return;
  }
};


export const getWorkspaceById = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = req.params.id;
    const userId = req.userId;

    const workspace = await Workspace.findOne({
      _id: workspaceId,
      createdBy: userId,
    })
      .populate("Interviews")
      .exec();

    if (!workspace) {
     res.status(404).json({ message: "Workspace not found" });
     return;
    }

    res.status(200).json({ workspace });
    return; 
  } catch (error) {
     res.status(500).json({ error: "Failed to fetch workspace" });
     return;
  }
};
